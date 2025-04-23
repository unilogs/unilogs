import { getBase, getInternalDir } from './utils.js';

export enum SourceType {
  File = 'file',
}

interface BaseSourceProps {
  sourceName: string;
  type: SourceType;
}

export interface FileSourceProps extends BaseSourceProps {
  include: string[];
  type: SourceType.File;
}

class BaseSource {
  readonly sourceName: BaseSourceProps['sourceName'];
  readonly type: BaseSourceProps['type'];

  constructor(props: BaseSourceProps) {
    this.type = props.type;
    this.sourceName = props.sourceName;
  }

  getSourceName() {
    return this.sourceName;
  }
  getObjectBody() {
    return {
      type: this.type,
    };
  }
}

export class FileSource extends BaseSource {
  private include: FileSourceProps['include'];

  constructor(props: FileSourceProps) {
    super(props);
    this.include = props.include;
  }

  addFileInclude(fileInclude: string) {
    this.include.push(fileInclude);
  }

  getInclude() {
    return [...this.include];
  }

  getObjectBody() {
    const returnBody = {
      ...super.getObjectBody(),
      include: [
        ...this.include.map(
          (includePath) =>
            `${getInternalDir(includePath)}/${getBase(includePath)}`
        ),
      ],
    };
    return returnBody;
  }
}

export type Source = FileSource;
