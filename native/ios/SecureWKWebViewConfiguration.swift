import WebKit

/// A dedicated class responsible for configuring WKWebView instances securely,
/// ensuring compliance with App Store Review Guidelines.
@objc public final class SecureWKWebViewConfiguration: NSObject {
    
    /// Generates a highly secure WKWebViewConfiguration.
    /// - Returns: A pre-configured WKWebViewConfiguration instance.
    @objc public static func makeSecureConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        
        // 1. Session Isolation & Privacy
        // We use a non-persistent website data store (ephemeral session).
        // This ensures that cookies, cache, and other local data are kept in-memory
        // and destroyed when the web view is dismissed, preventing cross-site tracking
        // and session data leakage.
        configuration.websiteDataStore = WKWebsiteDataStore.nonPersistent()
        
        // 2. Interaction & User Content Controller Setup
        // We set up a clean, structured WKUserContentController.
        // It contains NO active script message handlers to prevent automated App Store review flags
        // for data interception (e.g., intercepting credentials or form data).
        let userContentController = WKUserContentController()
        
        // Safe placeholder for future JS injection (currently disabled)
        // If JS injection is needed in the future, define and register scripts here,
        // ensuring they do not inspect password or sensitive input fields.
        /*
        let futureSecureScript = WKUserScript(
            source: "console.log('Safe script execution');",
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(futureSecureScript)
        */
        
        configuration.userContentController = userContentController
        
        // 3. Webpage Preferences
        let preferences = WKWebpagePreferences()
        // Enable JavaScript since merchant web pages (Amazon, Fnac, etc.) require JS to run correctly.
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences
        
        // 4. Secure Media and Process Preferences
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        
        return configuration
    }
}
