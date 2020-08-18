FROM land007/ubuntu-node:latest

MAINTAINER Jia Yiqiu <yiqiujia@hotmail.com>

RUN echo $(date "+%Y-%m-%d_%H:%M:%S") >> /.image_times && \
	echo $(date "+%Y-%m-%d_%H:%M:%S") > /.image_time && \
	echo "land007/http-proxy" >> /.image_names && \
	echo "land007/http-proxy" > /.image_name

RUN . $HOME/.nvm/nvm.sh && cd / && npm install basic-auth
ADD node/proxy.js /node_/server.js
ADD node/web-outgoing.js /node_modules/http-proxy/lib/http-proxy/passes/web-outgoing.js

ENV username=land007 \
	password=fcea920f7412b5da7be0cf42b8c93759 \
	http_proxy_domains="192.168.1.1:1080,192.168.1.1:1080" \
	http_proxy_paths="/api/,/" \
	http_proxy_hosts="192.168.1.218,192.168.1.218" \
	http_proxy_ports="8080,3000" \
	http_proxy_pretends="true true" \
	ws_proxy_domains="192.168.1.1:1080" \
	ws_proxy_paths="/api/" \
	ws_proxy_hosts="192.168.1.218" \
	ws_proxy_ports="8080"

ADD node/start.sh /node_/
ADD node/cert /node_/cert
RUN sed -i 's/\r//' /node_/start.sh

ENV DOMAIN_NAME=voice.qhkly.com
EXPOSE 80
EXPOSE 443
EXPOSE 8443

CMD /check.sh /node && /node/start.sh

# 代理，有问题啊/node_modules/http-proxy/lib/http-proxy/passes/web-outgoing.js:54:24
#//var target = url.parse(options.target);
#var target = options.target;

#docker build -t land007/http-proxy:latest .
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

