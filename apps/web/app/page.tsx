"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { WelcomePage } from "@/components/welcome/welcome-page";
import { api } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const checkHomePageConfig = async () => {
      // Reset state for fresh check
      setIsLoading(true);
      setShowWelcome(false);

      try {
        const config = await api.getConfig();

        // Check if home page is configured
        if (config.home_page_repository && config.home_page_article) {
          // Redirect to configured home page
          router.replace(`/${config.home_page_repository}/${config.home_page_article}`);
        } else {
          // Show welcome page
          setShowWelcome(true);
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
        // Show welcome page on error
        setShowWelcome(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkHomePageConfig();
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (showWelcome) {
    return <WelcomePage />;
  }

  return null;
}
