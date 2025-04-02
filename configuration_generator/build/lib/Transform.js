import { TransformSource } from './TransformSource.js';
export var TransformSourceOption;
(function (TransformSourceOption) {
    TransformSourceOption["Apache"] = "apache_template";
    TransformSourceOption["PlainText"] = "plaintext_template";
})(TransformSourceOption || (TransformSourceOption = {}));
class BaseTransform {
    constructor(props) {
        this.transformName = props.transformName;
        this.inputs = props.inputs;
        this.source = '';
    }
    addInput(input) {
        this.inputs.push(input);
    }
    setSource(source) {
        this.source = source;
    }
    getObjectBody() {
        return {
            type: 'remap',
            inputs: this.inputs.map((input) => input.sourceName),
            source: this.source,
        };
    }
}
export class ApacheTransform extends BaseTransform {
    constructor(props) {
        super(props);
        const apacheSource = new TransformSource(TransformSourceOption.Apache, props.serviceName);
        super.setSource(apacheSource.render());
    }
}
export class PlainTextTransform extends BaseTransform {
    constructor(props) {
        super(props);
        const plaintextSource = new TransformSource(TransformSourceOption.PlainText, props.serviceName);
        super.setSource(plaintextSource.render());
    }
}
