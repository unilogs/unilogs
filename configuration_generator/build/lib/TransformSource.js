import Mustache from 'mustache';
import * as templates from './templates.js';
export var TransformSourceOption;
(function (TransformSourceOption) {
    TransformSourceOption["Apache"] = "apache_template";
    TransformSourceOption["CLF"] = "clf_template";
    TransformSourceOption["LinuxAuthorization"] = "linux_authorization_template";
    TransformSourceOption["Logfmt"] = "logfmt_template";
    TransformSourceOption["Syslog"] = "syslog_template";
})(TransformSourceOption || (TransformSourceOption = {}));
// Note that we're using double brackets [[ and ]] rather than braces because
// the Vector template syntax uses braces.
Mustache.tags = ['[[', ']]'];
const sourceTemplates = {
    apache_template: templates.apache_template,
    clf_template: templates.clf_template,
    linux_authorization_template: templates.linux_authorization_template,
    logfmt_template: templates.logfmt_template,
    syslog_template: templates.syslog_template,
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
