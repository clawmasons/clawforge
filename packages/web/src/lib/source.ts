import { docs } from "../../.source";
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";

const mdxSource = createMDXSource(docs.docs, docs.meta);
// fumadocs-mdx@11 returns files as a function; fumadocs-core@15 expects an array
const files = typeof mdxSource.files === "function"
  ? (mdxSource.files as unknown as () => typeof mdxSource.files)()
  : mdxSource.files;

export const source = loader({
  baseUrl: "/docs",
  source: { files },
});
