FROM node:20-alpine
WORKDIR /app
COPY packages/nexus-core/ ./
RUN npm install --production || echo "No package.json yet"
EXPOSE 8081
HEALTHCHECK --interval=30s CMD wget --quiet --tries=1 --spider http://localhost:8081/ || exit 1
CMD ["sh", "-c", "if [ -f src/index.js ]; then node src/index.js; else node -e 'require(\"http\").createServer((req,res)=>{res.writeHead(200);res.end(\"Nexus OS Ready\")}).listen(8081)'; fi"]
