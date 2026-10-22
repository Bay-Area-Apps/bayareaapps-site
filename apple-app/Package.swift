// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BayAreaCore",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [.library(name: "BayAreaCore", targets: ["BayAreaCore"])],
    targets: [
        .target(name: "BayAreaCore"),
        .testTarget(name: "BayAreaCoreTests", dependencies: ["BayAreaCore"])
    ]
)
