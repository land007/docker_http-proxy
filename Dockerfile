FROM land007/ubuntu-node:latest

MAINTAINER Jia Yiqiu <yiqiujia@hotmail.com>

RUN echo $(date "+%Y-%m-%d_%H:%M:%S") >> /.image_times && \
	echo $(date "+%Y-%m-%d_%H:%M:%S") > /.image_time && \
	echo "land007/node-http-proxy" >> /.image_names && \
	echo "land007/node-http-proxy" > /.image_name

ADD proxy.js /node/server.js
RUN . $HOME/.nvm/nvm.sh && cd / && npm install basic-auth

ENV username=land007
ENV password=fcea920f7412b5da7be0cf42b8c93759

#docker rm -f node-http-proxy ; docker run -it --privileged --restart=always -v ~/docker/node-http-proxy:/node -p 10080:80 --name node-http-proxy land007/node-http-proxy:latest
