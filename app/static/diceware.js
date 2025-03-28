document.getElementById('diceware-key').innerText = sessionStorage.getItem('diceware');
sessionStorage.removeItem('diceware');

function continueClick(){
    location.href='/vault';
}

document.addEventListener('DOMContentLoaded', function() {
const continueButton = document.getElementById('continue-button');
if (continueButton) {
    continueButton.addEventListener('click', continueClick);
    }

// Add other event listeners here
});