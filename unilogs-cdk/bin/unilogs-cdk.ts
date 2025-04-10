#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { UnilogsCdkStack } from '../lib/unilogs-cdk-stack';

const app = new cdk.App();
new UnilogsCdkStack(app, 'UnilogsCdkStack');
app.synth();
