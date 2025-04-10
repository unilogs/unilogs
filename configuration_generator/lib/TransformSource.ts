import Mustache from 'mustache';
import fs from 'fs';

export enum TransformSourceOption {
  Apache = 'apache_template',
  CLF = 'clf_template',
  LinuxAuthorization = 'linux_authorization_template',
  Logfmt = 'logfmt_template',
  PlainText = 'plaintext_template',
  Syslog = 'syslog_template',
}

// Note that we're using double brackets [[ and ]] rather than braces because
// the Vector template syntax uses braces.
Mustache.tags = ['[[', ']]'];

const sourceTemplates: Record<TransformSourceOption, string> = {
  apache_template: fs.readFileSync('./apache-remap-template.vrl', 'utf8'),
  clf_template: fs.readFileSync('./clf-remap-template.vrl', 'utf8'),
  linux_authorization_template: fs.readFileSync(
    './linux-authorization-remap-template.vrl',
    'utf8'
  ),
  logfmt_template: fs.readFileSync('./logfmt-remap-template.vrl', 'utf8'),
  plaintext_template: fs.readFileSync('./plaintext-remap-template.vrl', 'utf8'),
  syslog_template: fs.readFileSync('./syslog-remap-template.vrl', 'utf8'),
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
