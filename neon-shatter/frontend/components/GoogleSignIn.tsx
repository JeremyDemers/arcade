"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type CredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: CredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

type GoogleSignInProps = {
  disabled?: boolean;
  onCredential: (credential: string) => void | Promise<void>;
};

export function GoogleSignIn({ disabled = false, onCredential }: GoogleSignInProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  const renderButton = useCallback(() => {
    if (!clientId || !containerRef.current || !window.google) return;
    containerRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) void callbackRef.current(response.credential);
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "signin_with",
      logo_alignment: "left",
      width: 240,
    });
  }, [clientId]);

  useEffect(() => {
    if (window.google) renderButton();
  }, [renderButton]);

  if (!clientId) {
    return <p className="google-config-note">Google sign-in needs a Web Client ID.</p>;
  }

  return (
    <div className={`google-signin${disabled ? " disabled" : ""}`} aria-busy={disabled}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderButton} />
      <div ref={containerRef} />
    </div>
  );
}
