FROM soajsorg/node

RUN mkdir -p /opt/soajs/soajs.constroller/node_modules/
WORKDIR /opt/soajs/soajs.constroller/
COPY . .
RUN npm install

CMD ["/bin/bash"]