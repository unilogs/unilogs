import { Source } from './Source.js';
import { TransformSource, TransformSourceOption } from './TransformSource.js';

interface TransformProps {
  transformName: string;
  serviceName: string;
  inputs: Source[];
}

class BaseTransform {
  readonly transformName: TransformProps['transformName'];
  private inputs: TransformProps['inputs'];
  private source: string;

  constructor(props: TransformProps) {
    this.transformName = props.transformName;
    this.inputs = props.inputs;
    this.source = '';
  }

  addInput(input: Source) {
    this.inputs.push(input);
  }

  setSource(source: string) {
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
  constructor(props: TransformProps) {
    super(props);
    const source = new TransformSource(
      TransformSourceOption.Apache,
      props.serviceName
    );
    super.setSource(source.render());
  }
}

export class ClfTransform extends BaseTransform {
  constructor(props: TransformProps) {
    super(props);
    const source = new TransformSource(
      TransformSourceOption.CLF,
      props.serviceName
    );
    super.setSource(source.render());
  }
}

export class LinuxAuthorizationTransform extends BaseTransform {
  constructor(props: TransformProps) {
    super(props);
    const source = new TransformSource(
      TransformSourceOption.LinuxAuthorization,
      props.serviceName
    );
    super.setSource(source.render());
  }
}

export class LogfmtTransform extends BaseTransform {
  constructor(props: TransformProps) {
    super(props);
    const source = new TransformSource(
      TransformSourceOption.Logfmt,
      props.serviceName
    );
    super.setSource(source.render());
  }
}

export class SyslogTransform extends BaseTransform {
  constructor(props: TransformProps) {
    super(props);
    const source = new TransformSource(
      TransformSourceOption.Syslog,
      props.serviceName
    );
    super.setSource(source.render());
  }
}

export type Transform =
  | ApacheTransform
  | ClfTransform
  | LinuxAuthorizationTransform
  | LogfmtTransform
  | SyslogTransform;
