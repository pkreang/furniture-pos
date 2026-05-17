import { buildApp } from "./app";

const app = buildApp();
const port = Number(process.env.API_PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => console.log(`API listening on ${address}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
