import Mustache from 'mustache';
import { TransformSourceOption } from './vector-types.js';
import fs from 'fs';

// Note that we're using double brackets [[ and ]] rather than braces because
// the Vector template syntax uses braces.
Mustache.tags = ['[[', ']]'];

const sourceTemplates: Record<TransformSourceOption, string> = {
  apache_template: fs.readFileSync('./apache-remap-template.vrl', 'utf8'),
  plaintext_template: fs.readFileSync('./plaintext-remap-template.vrl', 'utf8'),
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
