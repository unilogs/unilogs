// types/aws-eks-token.d.ts
declare module "aws-eks-token" {
  import * as AWS from "aws-sdk";

  /**
   * The EKSToken class generates a bearer token for authenticating to an EKS cluster.
   *
   * Under the hood it signs a presigned STS:GetCallerIdentity request (using SHA256/HMAC)
   * with the AWS credentials and embeds the cluster name (via the x-k8s-aws-id header).
   * The final token is prefixed with "k8s-aws-v1." and can be used as the Bearer token
   * in Kubernetes API requests.
   */
  export default class EKSToken {
    /**
     * Used internally to retrieve the AWS configuration (credentials, region, etc.)
     * via a callback.
     *
     * @returns A promise that resolves when the configuration has been loaded.
     */
    static preInspection(): Promise<any>;

    /**
     * Generates a bearer token for accessing an EKS cluster.
     *
     * @param clusterName - The name of your EKS cluster. Defaults to 'eks-cluster' if not provided.
     * @param expires - The expiration in seconds for the presigned URL. Defaults to '60'.
     * @param formatTime - Optional: a formatted timestamp string (if not provided, the current UTC time is used).
     * @returns A promise that resolves to a token string which is ready for use as a Kubernetes Bearer token.
     */
    static renew(
      clusterName?: string,
      expires?: string,
      formatTime?: string
    ): Promise<string>;

    /**
     * Gets the current AWS configuration used by EKSToken.
     */
    static get config(): AWS.Config;

    /**
     * Sets (updates) the AWS configuration used by EKSToken. The supplied option should
     * match the type AWS.ConfigOptions.
     *
     * @param option - The configuration options used to update the current AWS config.
     */
    // static set config(option: AWS.ConfigOptions);
  }
}
