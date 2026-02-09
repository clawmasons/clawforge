import { build } from "esbuild";

await build({
  entryPoints: ["src/lambda.ts"],
  outfile: "dist-lambda/index.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  minify: true,
  sourcemap: true,
  external: [],
  banner: {
    // pg uses CommonJS require() — shim it for ESM
    js: `import { createRequire } from "module"; const require = createRequire(import.meta.url);`,
  },
});

console.log("Lambda bundle built: dist-lambda/index.mjs");
