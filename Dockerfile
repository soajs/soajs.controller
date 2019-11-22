FROM soajsorg/node

RUN mkdir -p /opt/soajs/soajs.controller/node_modules/
WORKDIR /opt/soajs/soajs.controller/
COPY . .
RUN npm install

CMD ["/bin/bash"]