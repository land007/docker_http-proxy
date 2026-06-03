FROM node:20

MAINTAINER Jia Yiqiu <yiqiujia@hotmail.com>

RUN echo $(date "+%Y-%m-%d_%H:%M:%S") >> /.image_times && \
	echo $(date "+%Y-%m-%d_%H:%M:%S") > /.image_time && \
	echo "land007/http-proxy" >> /.image_names && \
	echo "land007/http-proxy" > /.image_name

RUN npm install -g basic-auth node-session express express-session session-file-store bcrypt multer express-validator csrf chokidar helmet cors http-proxy
ADD node/proxy.js /node_/server.js
ADD node/web-outgoing.js /node_modules/http-proxy/lib/http-proxy/passes/web-outgoing.js
ADD node/admin-api.js /node_/admin-api.js
ADD node/proxy-config-loader.js /node_/proxy-config-loader.js
ADD node/config-validator.js /node_/config-validator.js
ADD node/auth-manager.js /node_/auth-manager.js
ADD node/acme-manager.js /node_/acme-manager.js
ADD node/proxy-stats.js /node_/proxy-stats.js
ADD node/data-paths.js /node_/data-paths.js
ADD node/web-ui /node_/web-ui
ADD ddns /node_/ddns

ENV username="land007" \
	password="fcea920f7412b5da7be0cf42b8c93759" \
	usernames="," \
	passwords="," \
	max_session="0" \
	http_proxy_protocols="http:,https:" \
	http_proxy_domains="192.168.1.1:1080,192.168.1.1:1443" \
	http_proxy_paths="/api/,/" \
	http_proxy_hosts="192.168.1.218,192.168.1.218" \
	http_proxy_ports="8080,3000" \
	http_proxy_pretends="true,true" \
	ws_proxy_protocols="ws:,wss:" \
	ws_proxy_domains="192.168.1.1:1080,192.168.1.1:1443" \
	ws_proxy_paths="/api/,/" \
	ws_proxy_hosts="192.168.1.218,192.168.1.218" \
	ws_proxy_ports="8080,3000" \
	ws_proxy_pretends="true,true" \
	DATA_DIR="/node_/data"

ADD node/start.sh /node_/
ADD node/cert /node_/seed/cert
RUN sed -i 's/\r//' /node_/start.sh
ADD node/admin_users.json /node_/seed/admin_users.json
ADD proxy-config.json /node_/seed/proxy-config.json

EXPOSE 80
EXPOSE 443
EXPOSE 8443

# Install supervisor and other dependencies
RUN npm install -g supervisor

# Create simplified start script
RUN echo '#!/bin/bash\n\
export NODE_PATH=/usr/local/lib/node_modules\n\
: "${DATA_DIR:=/node_/data}"\n\
mkdir -p "$DATA_DIR/cert" "$DATA_DIR/backups" "$DATA_DIR/sessions"\n\
[ -f "$DATA_DIR/proxy-config.json" ] || cp /node_/seed/proxy-config.json "$DATA_DIR/"\n\
[ -f "$DATA_DIR/admin_users.json" ] || cp /node_/seed/admin_users.json "$DATA_DIR/"\n\
if [ -d /node_/seed/cert ] && [ -z "$(ls -A "$DATA_DIR/cert" 2>/dev/null)" ]; then cp -a /node_/seed/cert/. "$DATA_DIR/cert/"; fi\n\
while true; do node /node_/ddns/ddns-server.js >> /tmp/ddns-server.log 2>&1; sleep 2; done &\n\
export ADMIN_API_PORT=${ADMIN_API_PORT:-18444}\n\
export PUBLIC_ADMIN_PORT=${PUBLIC_ADMIN_PORT:-${ADMIN_PORT:-8444}}\n\
export ADMIN_PORT=$ADMIN_API_PORT\n\
nohup node /node_/admin-api.js > /tmp/admin-api.log 2>&1 &\n\
while true; do node /node_/ddns/admin-splitter.js >> /tmp/admin-splitter.log 2>&1; sleep 2; done &\n\
supervisor -w /node_/ -i node_modules /node_/server.js\n\
' > /node_/start-simple.sh && chmod +x /node_/start-simple.sh

VOLUME ["/node_/data"]

CMD ["/node_/start-simple.sh"]

#/node_modules/http-proxy/lib/http-proxy/passes/web-outgoing.js:54:24
#//var target = url.parse(options.target);
#var target = options.target;

#docker build -t land007/http-proxy:latest .
#> docker buildx build --platform linux/amd64,linux/arm64/v8,linux/arm/v7 -t land007/http-proxy --push .

#docker save -o http-proxy.tar land007/http-proxy:latest

#docker rm -f http-proxy ; sudo rm -rf ~/docker/http-proxy ; docker run -it --privileged --restart=always -v ~/docker/http-proxy:/node -p 10080:80 --name http-proxy land007/http-proxy:latest
#docker rm -f http-proxy ; sudo rm -rf ~/docker/http-proxy ; docker run -it --privileged --restart=always -v ~/docker/http-proxy:/node -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=7070" -p 10080:80 -p 10443:443 --name http-proxy land007/http-proxy:latest
#docker rm -f http-proxy ; sudo rm -rf ~/docker/http-proxy ; docker run -it --privileged --rm -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=7070" -e "password=" -p 10080:80 -p 10443:443 --name http-proxy land007/http-proxy:latest
#docker rm -f http-proxy ; sudo rm -rf ~/docker/http-proxy ; docker run -it --privileged --rm -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=7070" -e "password=" -p 10080:80 -p 10443:443 --name http-proxy land007/http-proxy:latest
#docker run -it --privileged --rm -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=8080" -e "password=" -p 10080:80 -p 6060:443 --name http-proxy land007/http-proxy:latest

#docker run -it --privileged --restart=always -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=6061" -e "password=" -p 10080:80 -p 6060:443 --name http-proxy land007/http-proxy:latest
#docker run -it --privileged --restart=always -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/scm/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=8081" -e "password=" -p 10081:80 -p 8080:443 --name http-proxy1 land007/http-proxy:latest

#docker run -it --privileged --restart=always -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.1.228" -e "http_proxy_ports=3001" -e "password=" -p 10081:80 -p 6060:443 --name http-proxy1 land007/http-proxy:latest
#docker run -it --privileged --rm -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/" -e "http_proxy_hosts=172.19.80.1" -e "http_proxy_ports=3001" -e "ws_proxy_paths=/" -e "ws_proxy_hosts=172.19.80.1" -e "ws_proxy_ports=3001" -e "password=" -p 10081:80 -p 6060:443 --name http-proxy1 land007/http-proxy:latest

#systemctl start firewalld.service
#docker rm -f http-proxy; docker run -it --privileged --restart=always -e "DOMAIN_NAME=www.gjxt.xyz" -e "http_proxy_paths=/" -e "http_proxy_hosts=192.168.181.134" -e "http_proxy_ports=6061" -e "ws_proxy_paths=/" -e "ws_proxy_hosts=192.168.181.134" -e "ws_proxy_ports=6061" -e "username=gjxt" -p 10080:80 -p 6060:443 --name http-proxy land007/http-proxy:latest
#systemctl stop firewalld.service

#[root@bogon Desktop]# systemctl stop firewalld.service
#[root@bogon Desktop]# systemctl start firewalld.service
