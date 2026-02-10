import { Metadata } from "next";

interface Props {
  children: React.ReactNode;
  params: Promise<{ chain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain } = await params;

  try {
    let chains;
    
    // Try to read chains directly from filesystem (faster in dev mode)
    if (process.env.NODE_ENV === 'development') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const chainsDir = path.join(process.cwd(), 'Chains');
        const files = fs.readdirSync(chainsDir).filter(file => file.endsWith('.json'));
        chains = files.map(file => {
          const filePath = path.join(chainsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(fileContent);
        });
      } catch (fsError) {
        console.warn('Failed to read chains from filesystem, falling back to API');
        throw fsError;
      }
    } else {
      // In production, use API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/chains`, {
        cache: "force-cache", // Use cache to avoid repeated slow requests
        signal: controller.signal,
        next: { revalidate: 300 } // Revalidate every 5 minutes
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Response is not JSON:", await res.text());
        throw new Error("Response is not JSON");
      }
      
      chains = await res.json();
    }

    const selected = chains.find(
      (c: any) =>
        c.chain_name.toLowerCase().replace(/\s+/g, "-") === chain.toLowerCase()
    );

    if (!selected) {
      return {
        title: "Chain Not Found — WinScan",
        description: "Explore blockchain data with WinScan",
      };
    }

    const chain_name = selected.chain_name
      .split("-")
    .map(
      (content: string) => content.charAt(0).toUpperCase() + content.slice(1)
    )
    .join(" ");
  const title = `${chain_name} Explorer — WinScan`;

  const description = `Winscan allows you to explore and search the ${chain_name} blockchain for transactions, addresses, tokens, prices and other activities taking place on ${chain_name}`;

  const image = selected.logo ?? "/logo.svg";

  return {
    title,
    description,
    keywords: [
      title,
      `${chain_name} scan`,
      `WinScan Explorer`,
      `winscan`,
      `explorer ${chain_name}`,
    ],
    openGraph: {
      title,
      description,
      images: [image],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
  } catch (error) {
    console.error("Error fetching chain metadata:", error);
    
    // Return fallback metadata with chain name from URL
    const chainName = chain
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    
    return {
      title: `${chainName} Explorer — WinScan`,
      description: `Explore ${chainName} blockchain data with WinScan`,
      keywords: ["WinScan", "blockchain explorer", chainName, "crypto explorer"],
      openGraph: {
        title: `${chainName} Explorer — WinScan`,
        description: `Explore ${chainName} blockchain data with WinScan`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${chainName} Explorer — WinScan`,
        description: `Explore ${chainName} blockchain data with WinScan`,
      },
    };
  }
}

export default function Layout({ children }: Props) {
  return <>{children}</>;
}
