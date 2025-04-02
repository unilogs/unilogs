import { Source } from './Source.js';
import { TransformSource } from './TransformSource.js';

export enum TransformSourceOption {
  Apache = 'apache_template',
  PlainText = 'plaintext_template',
}

interface BaseTransformProps {
  transformName: string;
  serviceName: string;
  inputs: Source[];
}

export interface ApacheTransformProps extends BaseTransformProps {}

export interface PlaintextTransformProps extends BaseTransformProps {}

class BaseTransform {
  readonly transformName: BaseTransformProps['transformName'];
  private inputs: BaseTransformProps['inputs'];
  private source: string;

  constructor(props: BaseTransformProps) {
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

  getTransformName() {
    return this.transformName;
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
  constructor(props: ApacheTransformProps) {
    super(props);
    const apacheSource = new TransformSource(
      TransformSourceOption.Apache,
      props.serviceName
    );
    super.setSource(apacheSource.render());
  }
}

export class PlainTextTransform extends BaseTransform {
  constructor(props: PlaintextTransformProps) {
    super(props);
    const plaintextSource = new TransformSource(
      TransformSourceOption.PlainText,
      props.serviceName
    );
    super.setSource(plaintextSource.render());
  }
}

export type Transform = ApacheTransform | PlainTextTransform;