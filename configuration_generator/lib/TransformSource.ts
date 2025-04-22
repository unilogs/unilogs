import Mustache from 'mustache';
import * as templates from './templates.js';

export enum TransformSourceOption {
  Apache = 'apache_template',
  CLF = 'clf_template',
  LinuxAuthorization = 'linux_authorization_template',
  Logfmt = 'logfmt_template',
  Syslog = 'syslog_template',
}

// Note that we're using double brackets [[ and ]] rather than braces because
// the Vector template syntax uses braces.
Mustache.tags = ['[[', ']]'];

const sourceTemplates: Record<TransformSourceOption, string> = {
  apache_template: templates.apache_template,
  clf_template: templates.clf_template,
  linux_authorization_template: templates.linux_authorization_template,
  logfmt_template: templates.logfmt_template,
  syslog_template: templates.syslog_template,
};

export class TransformSource {
  private sourceTemplate: string;
  private serviceName: string;

  constructor(
    sourceTemplateSelection: TransformSourceOption,
    serviceName: string
  ) {
    this.sourceTemplate = sourceTemplates[sourceTemplateSelection];
    this.serviceName = serviceName;
  }
  render() {
    return Mustache.render(this.sourceTemplate, { service: this.serviceName });
  }
}
