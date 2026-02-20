FROM node:20-alpine
WORKDIR /app
COPY packages/sentinel-2.0/ ./
RUN npm install --production || echo "No package.json yet"
EXPOSE 8080
HEALTHCHECK --interval=30s CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1
CMD ["sh", "-c", "if [ -f src/index.js ]; then node src/index.js; else node -e 'require(\"http\").createServer((req,res)=>{res.writeHead(200);res.end(\"Sentinel OS Ready\")}).listen(8080)'; fi"]
