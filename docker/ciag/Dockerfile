FROM node:20-alpine
WORKDIR /app
COPY products/advisory/ ./
RUN npm install --production || echo "No package.json yet"
EXPOSE 8083
HEALTHCHECK --interval=30s CMD wget --quiet --tries=1 --spider http://localhost:8083/ || exit 1
CMD ["sh", "-c", "if [ -f src/index.js ]; then node src/index.js; else node -e 'require(\"http\").createServer((req,res)=>{res.writeHead(200);res.end(\"CIAG Advisory Ready\")}).listen(8083)'; fi"]
