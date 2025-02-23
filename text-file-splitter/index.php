<?php
// Set appropriate headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Include the HTML content
include 'index.html';
?>
