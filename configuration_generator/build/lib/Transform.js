export var TransformSourceOption;
(function (TransformSourceOption) {
    TransformSourceOption["Apache"] = "apache_template";
    TransformSourceOption["PlainText"] = "plaintext_template";
})(TransformSourceOption || (TransformSourceOption = {}));
class BaseTransform {
    constructor(props) {
        this.transformName = props.transformName;
        this.inputs = props.inputs;
        this.source = props.source;
    }
    addInput(input) {
        this.source.push(input);
    }
}
