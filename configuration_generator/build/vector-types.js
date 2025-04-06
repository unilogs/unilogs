export var TransformSourceOption;
(function (TransformSourceOption) {
    TransformSourceOption["Apache"] = "apache_template";
    TransformSourceOption["PlainText"] = "plaintext_template";
})(TransformSourceOption || (TransformSourceOption = {}));
export var SinkType;
(function (SinkType) {
    SinkType["Console"] = "console";
    SinkType["Loki"] = "loki";
    SinkType["Kafka"] = "kafka";
})(SinkType || (SinkType = {}));
export var ConsoleEncoding;
(function (ConsoleEncoding) {
    ConsoleEncoding["Logfmt"] = "logfmt";
    ConsoleEncoding["Json"] = "json";
})(ConsoleEncoding || (ConsoleEncoding = {}));
