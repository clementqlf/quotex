import UIKit
import WebKit

/// A native UIViewController displaying a WKWebView with a secure configuration,
/// enforcing HTTPS-only navigation, and presenting a transparent URL bar.
@objc public final class SecureWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    
    private var webView: WKWebView!
    private let initialURL: URL
    
    // UI Elements
    private let headerContainerView = UIView()
    private let urlLabel = UILabel()
    private let lockImageView = UIImageView()
    private let progressView = UIProgressView(progressViewStyle: .default)
    private let toolbar = UIToolbar()
    
    // KVO Observers
    private var urlObservation: NSKeyValueObservation?
    private var progressObservation: NSKeyValueObservation?
    
    // MARK: - Initializer
    
    @objc public init(url: URL) {
        // Enforce HTTPS at initialization time
        if url.scheme != "https" {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.scheme = "https"
            self.initialURL = components?.url ?? url
        } else {
            self.initialURL = url
        }
        super.init(nibName: nil, bundle: nil)
        self.modalPresentationStyle = .fullScreen
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupWebView()
        loadInitialRequest()
    }
    
    deinit {
        urlObservation?.invalidate()
        progressObservation?.invalidate()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // 1. Header Container for Transparency / URL Bar
        headerContainerView.translatesAutoresizingMaskIntoConstraints = false
        headerContainerView.backgroundColor = .secondarySystemBackground
        view.addSubview(headerContainerView)
        
        // Lock Image Icon
        lockImageView.translatesAutoresizingMaskIntoConstraints = false
        if #available(iOS 13.0, *) {
            lockImageView.image = UIImage(systemName: "lock.fill")
            lockImageView.tintColor = .systemGreen
        }
        headerContainerView.addSubview(lockImageView)
        
        // URL Host Label
        urlLabel.translatesAutoresizingMaskIntoConstraints = false
        urlLabel.font = .systemFont(ofSize: 14, weight: .medium)
        urlLabel.textColor = .label
        urlLabel.textAlignment = .center
        urlLabel.lineBreakMode = .byTruncatingHead
        headerContainerView.addSubview(urlLabel)
        
        // Close Button
        let closeButton = UIButton(type: .system)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setTitle("Terminer", for: .normal)
        closeButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        headerContainerView.addSubview(closeButton)
        
        // 2. Progress View
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = .systemBlue
        progressView.trackTintColor = .clear
        view.addSubview(progressView)
        
        // 3. Toolbar Setup for Navigation
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbar)
        
        let backItem = UIBarButtonItem(barButtonSystemItem: .rewind, target: self, action: #selector(backButtonTapped))
        let forwardItem = UIBarButtonItem(barButtonSystemItem: .fastForward, target: self, action: #selector(forwardButtonTapped))
        let reloadItem = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reloadButtonTapped))
        let flexibleSpace = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
        
        toolbar.items = [backItem, flexibleSpace, forwardItem, flexibleSpace, reloadItem]
        
        // Setup Constraints
        NSLayoutConstraint.activate([
            // Header view
            headerContainerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            headerContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerContainerView.heightAnchor.constraint(equalToConstant: 44),
            
            // Lock icon
            lockImageView.leadingAnchor.constraint(equalTo: headerContainerView.leadingAnchor, constant: 16),
            lockImageView.centerYAnchor.constraint(equalTo: headerContainerView.centerYAnchor),
            lockImageView.widthAnchor.constraint(equalToConstant: 16),
            lockImageView.heightAnchor.constraint(equalToConstant: 16),
            
            // URL label
            urlLabel.leadingAnchor.constraint(equalTo: lockImageView.trailingAnchor, constant: 8),
            urlLabel.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -8),
            urlLabel.centerYAnchor.constraint(equalTo: headerContainerView.centerYAnchor),
            
            // Close button
            closeButton.trailingAnchor.constraint(equalTo: headerContainerView.trailingAnchor, constant: -16),
            closeButton.centerYAnchor.constraint(equalTo: headerContainerView.centerYAnchor),
            
            // Progress view
            progressView.topAnchor.constraint(equalTo: headerContainerView.bottomAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2),
            
            // Toolbar (at the bottom)
            toolbar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }
    
    private func setupWebView() {
        // Retrieve the secure configuration from the dedicated architecture class
        let secureConfig = SecureWKWebViewConfiguration.makeSecureConfiguration()
        
        webView = WKWebView(frame: .zero, configuration: secureConfig)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        view.addSubview(webView)
        
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: progressView.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: toolbar.topAnchor)
        ])
        
        // Register KVO to update the UI dynamically
        urlObservation = webView.observe(\.url, options: .new) { [weak self] webView, _ in
            self?.updateURLDisplay(webView.url)
        }
        
        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] webView, _ in
            self?.progressView.progress = Float(webView.estimatedProgress)
            self?.progressView.isHidden = webView.estimatedProgress >= 1.0
        }
    }
    
    private func loadInitialRequest() {
        let request = URLRequest(url: initialURL)
        webView.load(request)
    }
    
    // MARK: - Actions
    
    @objc private func closeButtonTapped() {
        dismiss(animated: true, completion: nil)
    }
    
    @objc private func backButtonTapped() {
        if webView.canGoBack {
            webView.goBack()
        }
    }
    
    @objc private func forwardButtonTapped() {
        if webView.canGoForward {
            webView.goForward()
        }
    }
    
    @objc private func reloadButtonTapped() {
        webView.reload()
    }
    
    // MARK: - URL Display Update
    
    private func updateURLDisplay(_ url: URL?) {
        guard let url = url else {
            urlLabel.text = ""
            return
        }
        
        // Conform to Transparency Rule: Display the host domain name (e.g., www.amazon.fr)
        if let host = url.host {
            urlLabel.text = host
        } else {
            urlLabel.text = url.absoluteString
        }
        
        // Double check HTTPS status for the lock icon color
        if url.scheme == "https" {
            lockImageView.tintColor = .systemGreen
        } else {
            lockImageView.tintColor = .systemRed
        }
    }
    
    // MARK: - WKNavigationDelegate (HTTPS-only enforcement)
    
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        
        // Strict HTTPS rule. Intercept and block any HTTP connections.
        if url.scheme != "https" {
            decisionHandler(.cancel)
            showInsecureWarningAlert(url: url)
            return
        }
        
        decisionHandler(.allow)
    }
    
    private func showInsecureWarningAlert(url: URL) {
        let alert = UIAlertController(
            title: "Connexion non sécurisée bloquée",
            message: "Par mesure de sécurité, la navigation vers des pages non chiffrées (HTTP) est interdite : \(url.host ?? "site inconnu")",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: nil))
        present(alert, animated: true, completion: nil)
    }
}
