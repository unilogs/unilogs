export var SourceType;
(function (SourceType) {
    SourceType["File"] = "file";
})(SourceType || (SourceType = {}));
class BaseSource {
    constructor(props) {
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
    constructor(props) {
        super(props);
        this.include = props.include;
    }
    addFileInclude(fileInclude) {
        this.include.push(fileInclude);
    }
    getInclude() {
        return [...this.include];
    }
    getObjectBody() {
        const returnBody = {
            ...super.getObjectBody(),
            include: [...this.include]
        };
        return returnBody;
    }
}
