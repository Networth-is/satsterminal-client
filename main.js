(function () {
    console.log("YAYYYY ITS LOADING");
    const detectedProviders = new Set();
    const acknowledgedProviders = new Set();
    const eventListeners = {};

    // Helper function to get method names from any provider object
    function getProviderMethods(provider) {
      return Object.keys(provider).filter(key => typeof provider[key] === "function");
    }

    // Function to relay provider metadata (method names) to the iframe
    function relayProviderMetadata(providerName) {
      const provider = window[providerName];
      
      if (provider && !acknowledgedProviders.has(providerName)) {
        // Handle special case for XverseProviders
        if (providerName === "XverseProviders" && provider.BitcoinProvider) {
          // Send methods for XverseProviders
          const xverseMethods = getProviderMethods(provider);
          document.querySelectorAll("iframe").forEach((iframe) => {
            iframe.contentWindow.postMessage(
              { type: "PROVIDER_METADATA", providerName: "XverseProviders", methods: xverseMethods },
              "*"
            );
          });

          // Send methods for XverseProviders.BitcoinProvider
          const bitcoinProviderMethods = getProviderMethods(provider.BitcoinProvider);
          document.querySelectorAll("iframe").forEach((iframe) => {
            iframe.contentWindow.postMessage(
              { type: "PROVIDER_METADATA", providerName: "XverseProviders.BitcoinProvider", methods: bitcoinProviderMethods },
              "*"
            );
          });
        } else {
          // Default behavior for other providers
          const methodNames = getProviderMethods(provider);
          document.querySelectorAll("iframe").forEach((iframe) => {
            iframe.contentWindow.postMessage(
              { type: "PROVIDER_METADATA", providerName, methods: methodNames },
              "*"
            );
          });
        }
        detectedProviders.add(providerName);
      }
    }

    // Listen for acknowledgments from iframe
    window.addEventListener("message", (event) => {
      if (event.data.type === "PROVIDER_ACKNOWLEDGMENT") {
        const { providerName } = event.data;
        acknowledgedProviders.add(providerName);
        console.log(`Acknowledgment received for provider: ${providerName}`);
        
        // Disconnect observer if all providers are acknowledged
        if (acknowledgedProviders.size === providerNames.length) {
          console.log("All providers acknowledged, stopping observer");
          observer.disconnect();
        }
      }

      // Listen for method calls and event subscriptions
      if (event.data.type === "CALL_METHOD" || event.data.type === "SUBSCRIBE_EVENT") {
        const { providerName, methodName, args, requestId, eventName } = event.data;
        let provider = window[providerName.split('.')[0]]; // Get top-level provider

        // Check if we're calling a nested provider method
        if (providerName === "XverseProviders.BitcoinProvider") {
          provider = provider && provider.BitcoinProvider;
        }

        if (event.data.type === "CALL_METHOD" && provider && typeof provider[methodName] === "function") {
          provider[methodName](...args)
            .then((result) => {
              event.source.postMessage({ type: "METHOD_RESPONSE", requestId, result }, event.origin);
            })
            .catch((error) => {
              event.source.postMessage({ type: "METHOD_RESPONSE", requestId, error: error.message }, event.origin);
            });
        }

        // Handle event subscription
        if (event.data.type === "SUBSCRIBE_EVENT" && provider && typeof provider.on === "function") {
          if (!eventListeners[providerName]) {
            eventListeners[providerName] = {};
          }

          if (!eventListeners[providerName][eventName]) {
            eventListeners[providerName][eventName] = [];
            provider.on(eventName, (data) => {
              // Relay the event to all iframes that subscribed to it
              eventListeners[providerName][eventName].forEach((iframe) => {
                iframe.contentWindow.postMessage({ type: "EVENT_TRIGGER", providerName, eventName, data }, "*");
              });
            });
          }

          // Add the iframe to the list of listeners for this event
          eventListeners[providerName][eventName].push(event.source);
        }
      }
    });

    // Detect providers dynamically and relay metadata
    const providerNames = [
      "unisat",
      "XverseProviders",
      "magicEden",
      "okxwallet",
      "LeatherProvider",
      "phantom",
      "OrangeWalletProviders",
    ];


    // Observer to detect dynamically added providers
    const observer = new MutationObserver(() => {
      providerNames.forEach(providerName => {
        if (window[providerName]) {
          relayProviderMetadata(providerName);
        }
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Timeout to disconnect the observer after 30 seconds
    setTimeout(() => {
      if (observer) {
        console.log("Stopping observer after timeout");
        observer.disconnect();
      }
    }, 30000);

    // Clean up observer on page unload to prevent memory leaks
    window.addEventListener("beforeunload", () => observer.disconnect());
})();
