import Mustache from 'mustache';
import fs from 'fs';
export var TransformSourceOption;
(function (TransformSourceOption) {
    TransformSourceOption["Apache"] = "apache_template";
    TransformSourceOption["CLF"] = "clf_template";
    TransformSourceOption["LinuxAuthorization"] = "linux_authorization_template";
    TransformSourceOption["Logfmt"] = "logfmt_template";
    TransformSourceOption["PlainText"] = "plaintext_template";
    TransformSourceOption["Syslog"] = "syslog_template";
})(TransformSourceOption || (TransformSourceOption = {}));
// Note that we're using double brackets [[ and ]] rather than braces because
// the Vector template syntax uses braces.
Mustache.tags = ['[[', ']]'];
const sourceTemplates = {
    apache_template: fs.readFileSync('./apache-remap-template.vrl', 'utf8'),
    clf_template: fs.readFileSync('./clf-remap-template.vrl', 'utf8'),
    linux_authorization_template: fs.readFileSync('./linux-authorization-remap-template.vrl', 'utf8'),
    logfmt_template: fs.readFileSync('./logfmt-remap-template.vrl', 'utf8'),
    plaintext_template: fs.readFileSync('./plaintext-remap-template.vrl', 'utf8'),
    syslog_template: fs.readFileSync('./syslog-remap-template.vrl', 'utf8'),
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
