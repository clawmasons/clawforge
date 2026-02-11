import type { ReactNode } from "react";
import { NextProvider } from "fumadocs-core/framework/next";
import { RootProvider } from "fumadocs-ui/provider";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <NextProvider>
      <RootProvider theme={{ enabled: false }}>
        <DocsLayout
          tree={source.pageTree}
          nav={{ enabled: false }}
          themeSwitch={{ enabled: false }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </NextProvider>
  );
}
