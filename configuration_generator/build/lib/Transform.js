import { TransformSource, TransformSourceOption } from './TransformSource.js';
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
        const source = new TransformSource(TransformSourceOption.Apache, props.serviceName);
        super.setSource(source.render());
    }
}
export class ClfTransform extends BaseTransform {
    constructor(props) {
        super(props);
        const source = new TransformSource(TransformSourceOption.CLF, props.serviceName);
        super.setSource(source.render());
    }
}
export class LinuxAuthorizationTransform extends BaseTransform {
    constructor(props) {
        super(props);
        const source = new TransformSource(TransformSourceOption.LinuxAuthorization, props.serviceName);
        super.setSource(source.render());
    }
}
export class LogfmtTransform extends BaseTransform {
    constructor(props) {
        super(props);
        const source = new TransformSource(TransformSourceOption.Logfmt, props.serviceName);
        super.setSource(source.render());
    }
}
export class SyslogTransform extends BaseTransform {
    constructor(props) {
        super(props);
        const source = new TransformSource(TransformSourceOption.Syslog, props.serviceName);
        super.setSource(source.render());
    }
}
