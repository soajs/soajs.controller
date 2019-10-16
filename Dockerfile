FROM soajsorg/soajs

RUN mkdir -p /opt/soajs/soajs.contoller/node_modules/
WORKDIR /opt/soajs/soajs.contoller/
COPY . .
RUN npm install

CMD ["/bin/bash"]