import UIKit
import UniformTypeIdentifiers

class ShareExtensionViewController: UIViewController {
  private let fileManager = FileManager.default
  private var didStart = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    showRedirectingState()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !didStart else { return }
    didStart = true
    collectSharedPayload { [weak self] payload in
      guard let self else { return }
      guard !payload.isEmpty else {
        self.close()
        return
      }
      self.openHostApp(sharedText: payload)
    }
  }

  private func showRedirectingState() {
    let spinner = UIActivityIndicatorView(style: .medium)
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.startAnimating()

    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.text = "Opening Artifactory..."
    label.font = .preferredFont(forTextStyle: .body)
    label.textColor = .secondaryLabel

    let stack = UIStackView(arrangedSubviews: [spinner, label])
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 10

    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
  }

  private func collectSharedPayload(completion: @escaping (String) -> Void) {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
      completion("")
      return
    }

    let group = DispatchGroup()
    var values: [String] = []
    let valuesQueue = DispatchQueue(label: "artifactory.share.values")

    func append(_ value: String?) {
      guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
        return
      }
      valuesQueue.sync {
        if !values.contains(value) {
          values.append(value)
        }
      }
    }

    for item in extensionItems {
      for provider in item.attachments ?? [] {
        loadText(from: provider, group: group, append: append)
        loadURL(from: provider, group: group, append: append)
        loadImage(from: provider, group: group, append: append)
        loadMovie(from: provider, group: group, append: append)
      }
    }

    group.notify(queue: .main) {
      valuesQueue.sync {
        completion(values.joined(separator: " "))
      }
    }
  }

  private func loadText(
    from provider: NSItemProvider,
    group: DispatchGroup,
    append: @escaping (String?) -> Void
  ) {
    guard provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) else { return }
    group.enter()
    provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { item, _ in
      defer { group.leave() }
      if let text = item as? String {
        append(text)
      } else if let attributed = item as? NSAttributedString {
        append(attributed.string)
      }
    }
  }

  private func loadURL(
    from provider: NSItemProvider,
    group: DispatchGroup,
    append: @escaping (String?) -> Void
  ) {
    guard provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) else { return }
    group.enter()
    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
      defer { group.leave() }
      guard let self else { return }
      guard let url = item as? URL else { return }
      if url.isFileURL {
        append(self.persistFileURLIfNeeded(url))
      } else {
        append(url.absoluteString)
      }
    }
  }

  private func loadImage(
    from provider: NSItemProvider,
    group: DispatchGroup,
    append: @escaping (String?) -> Void
  ) {
    guard provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) else { return }
    group.enter()
    provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] item, _ in
      defer { group.leave() }
      guard let self else { return }

      if let url = item as? URL {
        append(self.persistFileURLIfNeeded(url, defaultExtension: "jpg"))
      } else if let image = item as? UIImage {
        append(self.persistImage(image))
      } else if let data = item as? Data {
        append(self.persistData(data, defaultExtension: "jpg"))
      }
    }
  }

  private func loadMovie(
    from provider: NSItemProvider,
    group: DispatchGroup,
    append: @escaping (String?) -> Void
  ) {
    guard provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) else { return }
    group.enter()
    provider.loadItem(forTypeIdentifier: UTType.movie.identifier, options: nil) { [weak self] item, _ in
      defer { group.leave() }
      guard let self else { return }

      if let url = item as? URL {
        append(self.persistFileURLIfNeeded(url, defaultExtension: "mov"))
      } else if let data = item as? Data {
        append(self.persistData(data, defaultExtension: "mov"))
      }
    }
  }

  private func sharedDataDirectory() -> URL? {
    guard let appGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String else {
      return nil
    }
    guard let containerURL = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      return nil
    }
    let directory = containerURL.appendingPathComponent("sharedData", isDirectory: true)
    if !fileManager.fileExists(atPath: directory.path) {
      try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    return directory
  }

  private func persistFileURLIfNeeded(_ url: URL, defaultExtension: String = "bin") -> String? {
    guard url.isFileURL else { return url.absoluteString }
    guard let directory = sharedDataDirectory() else { return url.absoluteString }
    let ext = url.pathExtension.isEmpty ? defaultExtension : url.pathExtension
    let destination = directory.appendingPathComponent("\(UUID().uuidString).\(ext)")
    do {
      if fileManager.fileExists(atPath: destination.path) {
        try fileManager.removeItem(at: destination)
      }
      try fileManager.copyItem(at: url, to: destination)
      return destination.absoluteString
    } catch {
      return url.absoluteString
    }
  }

  private func persistImage(_ image: UIImage) -> String? {
    guard let data = image.jpegData(compressionQuality: 0.92) else { return nil }
    return persistData(data, defaultExtension: "jpg")
  }

  private func persistData(_ data: Data, defaultExtension: String) -> String? {
    guard let directory = sharedDataDirectory() else { return nil }
    let destination = directory.appendingPathComponent("\(UUID().uuidString).\(defaultExtension)")
    do {
      try data.write(to: destination, options: .atomic)
      return destination.absoluteString
    } catch {
      return nil
    }
  }

  private func openHostApp(sharedText: String) {
    guard let scheme = Bundle.main.object(forInfoDictionaryKey: "HostAppScheme") as? String else {
      close()
      return
    }
    var components = URLComponents()
    components.scheme = scheme
    components.path = "/links/import"
    components.queryItems = [URLQueryItem(name: "sharedText", value: sharedText)]

    guard let url = components.url else {
      close()
      return
    }
    _ = openURL(url)
    close()
  }

  @objc @discardableResult private func openURL(_ url: URL) -> Bool {
    var responder: UIResponder? = self
    while let current = responder {
      if let application = current as? UIApplication {
        application.open(url, options: [:], completionHandler: nil)
        return true
      }
      responder = current.next
    }

    let selector = NSSelectorFromString("openURL:")
    responder = self
    while let current = responder {
      if current.responds(to: selector) {
        current.perform(selector, with: url)
        return true
      }
      responder = current.next
    }

    return false
  }

  private func close() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
