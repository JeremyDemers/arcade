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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  const initializedRef = useRef(false);
  const renderedWidthRef = useRef(0);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  const renderButton = useCallback(() => {
    if (!clientId || !containerRef.current || !window.google) return;

    const width = Math.floor(containerRef.current.getBoundingClientRect().width);
    if (width < 1 || width === renderedWidthRef.current) return;

    containerRef.current.replaceChildren();
    if (!initializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) void callbackRef.current(response.credential);
        },
      });
      initializedRef.current = true;
    }

    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width,
    });
    renderedWidthRef.current = width;
  }, [clientId]);

  useEffect(() => {
    if (window.google) renderButton();

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const resizeObserver = new ResizeObserver(renderButton);
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, [renderButton]);

  if (!clientId) {
    return <p className="google-config-note">Google sign-in needs a Web Client ID.</p>;
  }

  return (
    <div ref={wrapperRef} className={`google-signin${disabled ? " disabled" : ""}`} aria-busy={disabled}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderButton} />
      <div ref={containerRef} className="google-signin-button" />
    </div>
  );
}
