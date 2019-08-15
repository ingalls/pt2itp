#!/usr/bin/env node
'use strict';

const AWS = require('aws-sdk');
const { promisify } = require('util');
const { App } = require('@octokit/app');

async function getCredentials(secretPrefix) {
    const options = {
        region: 'us-east-1'
    };

    const sm = new AWS.SecretsManager(options);

    const [
        { SecretString: id },
        { SecretString: installationId },
        { SecretBinary: privateKey }
    ] = await Promise.all([
        sm.getSecretValue({ SecretId: `${secretPrefix}/app-id` }).promise(),
        sm.getSecretValue({ SecretId: `${secretPrefix}/installation-id` }).promise(),
        sm.getSecretValue({ SecretId: `${secretPrefix}/secret` }).promise()
    ]);

    return { id, installationId, privateKey };
}

async function getGitHubToken(secretPrefix) {
    const { id, installationId, privateKey } = await getCredentials(secretPrefix);

    const app = new App({ id, privateKey });

    const getToken = async (attempts = 0) => {
        attempts++;
        try { return await app.getInstallationAccessToken({ installationId }); }
        catch (err) {
            if (err.status > 499 && err.status < 600 && attempts < 5) {
                await promisify(setTimeout)(Math.pow((Math.random() * 2), attempts));
                return await getToken(attempts);
            } else {
                throw err;
            }
        }
    };

    return await getToken();
}

(async function() {
    const secretPrefix = process.argv[2];
    if (!secretPrefix) throw new Error('Prefix value required.');
    const token = await getGitHubToken(secretPrefix);
    console.log(token);
})();
