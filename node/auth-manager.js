/**
 * Authentication Manager
 * Manages admin user authentication with bcrypt
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const ADMIN_USERS_PATH = path.join(__dirname, 'admin_users.json');
const SALT_ROUNDS = 10;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD-Admin';
// Session lifetime (default 24h). Overridable via ADMIN_SESSION_MAX_AGE_MS.
// Combined with rolling sessions, active users are not logged out mid-task.
const SESSION_MAX_AGE = parseInt(process.env.ADMIN_SESSION_MAX_AGE_MS, 10) || 24 * 60 * 60 * 1000;

class AuthManager {
	constructor() {
		this.users = [];
		this.loadUsers();
	}

	/**
	 * Load admin users from file
	 */
	loadUsers() {
		try {
			if (fs.existsSync(ADMIN_USERS_PATH)) {
				const data = fs.readFileSync(ADMIN_USERS_PATH, 'utf-8');
				this.users = JSON.parse(data);
			} else {
				// Create default admin user if file doesn't exist
				this.users = [{
					id: 'admin-1',
					username: 'admin',
					passwordHash: null, // Will be set below
					createdAt: new Date().toISOString(),
					lastLogin: null,
					mustChangePassword: true
				}];

				// Hash default password (admin123)
				this.hashPassword('admin123').then(hash => {
					this.users[0].passwordHash = hash;
					this.saveUsers();
					console.log('⚠️  Default admin user created (admin/admin123)');
					console.log('⚠️  Please change the default password immediately!');
				});

				this.saveUsers();
			}
		} catch (error) {
			console.error('⛔ Error loading admin users:', error);
			this.users = [];
		}
	}

	/**
	 * Save admin users to file
	 */
	saveUsers() {
		try {
			fs.writeFileSync(ADMIN_USERS_PATH, JSON.stringify(this.users, null, 2), 'utf-8');
		} catch (error) {
			console.error('⛔ Error saving admin users:', error);
		}
	}

	/**
	 * Hash a password using bcrypt
	 * @param {string} password - Plain text password
	 * @returns {Promise<string>} - Hashed password
	 */
	async hashPassword(password) {
		return await bcrypt.hash(password, SALT_ROUNDS);
	}

	/**
	 * Verify a password against a hash
	 * @param {string} password - Plain text password
	 * @param {string} hash - Hashed password
	 * @returns {Promise<boolean>} - True if password matches
	 */
	async verifyPassword(password, hash) {
		return await bcrypt.compare(password, hash);
	}

	/**
	 * Authenticate a user
	 * @param {string} username - Username
	 * @param {string} password - Plain text password
	 * @returns {Promise<Object|null>} - User object if authenticated, null otherwise
	 */
	async authenticate(username, password) {
		const user = this.users.find(u => u.username === username);

		if (!user || !user.passwordHash) {
			return null;
		}

		const isValid = await this.verifyPassword(password, user.passwordHash);

		if (!isValid) {
			return null;
		}

		// Update last login time
		user.lastLogin = new Date().toISOString();
		this.saveUsers();

		// Return user without password hash
		return {
			id: user.id,
			username: user.username,
			createdAt: user.createdAt,
			lastLogin: user.lastLogin,
			mustChangePassword: !!user.mustChangePassword
		};
	}

	/**
	 * Get a user by ID
	 * @param {string} userId - User ID
	 * @returns {Object|null} - User object without password hash
	 */
	getUserById(userId) {
		const user = this.users.find(u => u.id === userId);

		if (!user) {
			return null;
		}

		return {
			id: user.id,
			username: user.username,
			createdAt: user.createdAt,
			lastLogin: user.lastLogin,
			mustChangePassword: !!user.mustChangePassword
		};
	}

	/**
	 * Get all admin users (without password hashes)
	 * @returns {Array} - Array of user objects
	 */
	getAllUsers() {
		return this.users.map(user => ({
			id: user.id,
			username: user.username,
			createdAt: user.createdAt,
			lastLogin: user.lastLogin,
			mustChangePassword: !!user.mustChangePassword
		}));
	}

	/**
	 * Create a new admin user
	 * @param {string} username - Username
	 * @param {string} password - Plain text password
	 * @returns {Promise<Object>} - Created user object
	 */
	async createUser(username, password) {
		// Check if username already exists
		if (this.users.find(u => u.username === username)) {
			throw new Error('Username already exists');
		}

		// Validate username
		if (!username || username.length < 3) {
			throw new Error('Username must be at least 3 characters');
		}

		// Validate password
		if (!password || password.length < 6) {
			throw new Error('Password must be at least 6 characters');
		}

		// Hash password
		const passwordHash = await this.hashPassword(password);

		// Create user
		const user = {
			id: `admin-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
			username,
			passwordHash,
			createdAt: new Date().toISOString(),
			lastLogin: null,
			mustChangePassword: false
		};

		this.users.push(user);
		this.saveUsers();

		return {
			id: user.id,
			username: user.username,
			createdAt: user.createdAt,
			lastLogin: user.lastLogin,
			mustChangePassword: !!user.mustChangePassword
		};
	}

	/**
	 * Change a user's own password after verifying the old password.
	 * @param {string} userId - User ID
	 * @param {string} oldPassword - Current plain text password
	 * @param {string} newPassword - New plain text password
	 * @returns {Promise<Object>} - Updated public user object
	 */
	async changeOwnPassword(userId, oldPassword, newPassword) {
		const user = this.users.find(u => u.id === userId);

		if (!user || !user.passwordHash) {
			throw new Error('User not found');
		}

		if (!newPassword || newPassword.length < 6) {
			throw new Error('Password must be at least 6 characters');
		}

		const oldPasswordValid = await this.verifyPassword(oldPassword, user.passwordHash);
		if (!oldPasswordValid) {
			throw new Error('Current password is incorrect');
		}

		user.passwordHash = await this.hashPassword(newPassword);
		user.mustChangePassword = false;
		this.saveUsers();

		return this.getUserById(userId);
	}

	/**
	 * Update a user's password
	 * @param {string} userId - User ID
	 * @param {string} newPassword - New plain text password
	 * @returns {Promise<boolean>} - True if updated successfully
	 */
	async updateUserPassword(userId, newPassword) {
		const user = this.users.find(u => u.id === userId);

		if (!user) {
			return false;
		}

		// Validate password
		if (!newPassword || newPassword.length < 6) {
			throw new Error('Password must be at least 6 characters');
		}

		// Hash new password
		user.passwordHash = await this.hashPassword(newPassword);
		user.mustChangePassword = false;
		this.saveUsers();

		return true;
	}

	/**
	 * Delete a user
	 * @param {string} userId - User ID
	 * @returns {boolean} - True if deleted successfully
	 */
	deleteUser(userId) {
		const index = this.users.findIndex(u => u.id === userId);

		if (index === -1) {
			return false;
		}

		// Prevent deleting the last admin
		if (this.users.length === 1) {
			throw new Error('Cannot delete the last admin user');
		}

		this.users.splice(index, 1);
		this.saveUsers();

		return true;
	}

	/**
	 * Generate session secret
	 * @returns {string} - Session secret
	 */
	getSessionSecret() {
		return SESSION_SECRET;
	}

	/**
	 * Get session max age
	 * @returns {number} - Session max age in milliseconds
	 */
	getSessionMaxAge() {
		return SESSION_MAX_AGE;
	}
}

// Create singleton instance
const authManager = new AuthManager();

module.exports = authManager;
