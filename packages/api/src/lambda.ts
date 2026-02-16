import awsLambdaFastify from "@fastify/aws-lambda";
import { createApp } from "./app.js";

const app = createApp();
const proxy = app.then((server) => awsLambdaFastify(server));

export const handler: import("aws-lambda").Handler = async (event, context) => {
  const p = await proxy;
  return p(event, context);
};
