from kafka import KafkaProducer
import boto3
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

try:
    # Get MSK brokers
    client = boto3.client('kafka', region_name='us-west-1')
    cluster_arn = client.list_clusters()['ClusterInfoList'][0]['ClusterArn']
    brokers = client.get_bootstrap_brokers(
        ClusterArn=cluster_arn
    )['BootstrapBrokerStringSaslIam'].split(',')

    logger.info(f"Connecting to brokers: {brokers}")

    # Create producer with IAM authentication
    producer = KafkaProducer(
        bootstrap_servers=brokers,
        security_protocol='SASL_SSL',
        sasl_mechanism='OAUTHBEARER',
        sasl_oauth_token_provider='software.amazon.msk.auth.iam.IAMLoginModule'
    )

    # Send test message
    test_message = b'Test message from Python SDK at ' + str(datetime.datetime.now()).encode()
    future = producer.send('app_logs_topic', test_message)
    
    # Wait for confirmation
    record_metadata = future.get(timeout=10)
    logger.info(f"Message sent successfully to topic {record_metadata.topic} " 
               f"partition {record_metadata.partition} "
               f"offset {record_metadata.offset}")

except Exception as e:
    logger.error(f"Failed to send message: {str(e)}")
    raise

finally:
    if 'producer' in locals():
        producer.flush()
        producer.close()