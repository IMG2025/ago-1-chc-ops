import app from './server.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Digital Labor API Gateway running on port ${PORT}`);
});
