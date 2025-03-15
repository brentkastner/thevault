function loginPage() {
    location.href='index.html'
}

function createPage() {
    location.href='create.html'
}

document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('login-page');
    if (loginButton) {
        loginButton.addEventListener('click', loginPage);
    }
    
    const createButton = document.getElementById('create-page');
    if (createButton) {
        createButton.addEventListener('click', createPage);
    }
    // Add other event listeners here
});