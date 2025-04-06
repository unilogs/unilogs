import child_process from 'child_process';
child_process.exec('docker sprangfrangle build -t unilogs-shipper:latest .', (error, stdout, stderr) => {
    if (error)
        console.log(error);
    if (stdout)
        console.log(stdout);
    if (stderr)
        console.error(stderr);
});
