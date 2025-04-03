import Mustache from 'mustache';
import fs from 'fs';
export var TransformSourceOption;
(function (TransformSourceOption) {
    TransformSourceOption["Apache"] = "apache_template";
    TransformSourceOption["PlainText"] = "plaintext_template";
})(TransformSourceOption || (TransformSourceOption = {}));
// Note that we're using double brackets [[ and ]] rather than braces because
// the Vector template syntax uses braces.
Mustache.tags = ['[[', ']]'];
const sourceTemplates = {
    apache_template: fs.readFileSync('./apache-remap-template.vrl', 'utf8'),
    plaintext_template: fs.readFileSync('./plaintext-remap-template.vrl', 'utf8'),
};
export class TransformSource {
    constructor(sourceTemplateSelection, serviceName) {
        this.sourceTemplate = sourceTemplates[sourceTemplateSelection];
        this.serviceName = serviceName;
    }
    render() {
        return Mustache.render(this.sourceTemplate, { service: this.serviceName });
    }
}
