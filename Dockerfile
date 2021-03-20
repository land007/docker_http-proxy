FROM land007/node:latest

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
	ws_proxy_ports="8080,3000"

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
#> docker buildx build --platform linux/amd64,linux/arm64/v8,linux/arm/v7 -t land007/http-proxy --push .

#[root@bogon Desktop]# systemctl stop firewalld.service
#[root@bogon Desktop]# systemctl start firewalld.service

