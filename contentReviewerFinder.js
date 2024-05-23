const host = window.location.host;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fillForm") {
        alert("fillform");
        document.getElementById("paper_title").value = message.title || "";
        document.getElementById("paper_authors").value = message.authors || "";
        document.getElementById("paper_abstract").value =
            message.abstract || "";
        sendResponse({ status: "Form filled" });
    }
});

// This function is assumed to be part of your content script for reviewerfinder.nature.com
function processReviewerPanels() {
    let uniqueIdCounter = 0; // If generating unique IDs

    const reviewerPanels = document.querySelectorAll(".reviewer_panel");

    reviewerPanels.forEach((panel) => {
        // Extracting the reviewer's name
        const nameElement = panel.querySelector(
            "a.name.button-cta.button-right-cta"
        );
        const reviewerName = nameElement
            ? nameElement.textContent.trim()
            : "Unknown";

        // Extracting the reviewer's email
        const emailElement = panel.querySelector("a.email_value");
        const reviewerEmail = emailElement
            ? new URL(emailElement.href).pathname.replace("/mailto:", "")
            : "Unknown";

        // Extracting the reviewer's institution
        const institutionElement = panel.querySelector("li.affiliation");
        const reviewerInstitution = institutionElement
            ? institutionElement.textContent.trim()
            : "Unknown";

        const uniqueId = reviewerEmail || `reviewer-${uniqueIdCounter++}`; // Use email or a generated ID

        // Insert "Assign" button
        const assignButton = document.createElement("button");
        assignButton.textContent = "↖️ Add to eJP shortlist";
        assignButton.dataset.reviewerId = uniqueId;
        assignButton.classList.add("assign-reviewer-btn"); // Add class for styling if needed

        assignButton.onclick = (event) => {
            event.preventDefault(); // Prevent form submission
            // Clear existing button text and disable the button
            assignButton.textContent = "";
            assignButton.disabled = true;

            // Create and add spinner element
            let spinner = document.createElement("div");
            //spinner.classList.add("spinner");
            spinner = createSpinner();
            assignButton.appendChild(spinner);
            sendReviewerDataToMtsTab(
                reviewerName,
                reviewerEmail,
                reviewerInstitution,
                uniqueId
            );
        };

        panel.appendChild(assignButton);
    });
}

// Function to handle the click event of the "Assign" button
// Assuming this function is triggered when the "Assign" button is clicked
function sendReviewerDataToMtsTab(fullName, email, inst, uniqueId) {
    // Splitting fullName into first and last names
    const [lastName, firstName] = fullName
        .split(", ")
        .map((name) => name.trim());
    console.log(firstName, lastName, email);
    // Send a message to your extension's background script
    chrome.runtime.sendMessage({
        action: "sendReviewerDataToMts",
        data: { firstName, lastName, email, inst, uniqueId }
    });
}


//listen for assignment completion messages from MTS
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateAssignmentStatus") {

        // Delay duration in milliseconds
        const delay = 1000; // For a 1 second delay

        setTimeout(() => {
            const assignButton = document.querySelector(
                `button[data-reviewer-id="${message.uniqueId}"]`
            );

            if (assignButton) {
                // Remove spinner
                const spinner = assignButton.querySelector(".spinner");
                if (spinner) {
                    spinner.remove();
                }

                // Update button text based on the operation result
                if (message.status === "success") {
                    assignButton.textContent = "✅";
                    assignButton.classList.add("button-disabled");
                } else if (message.status === "error") {
                    assignButton.textContent = "Error";
                    assignButton.classList.add("button-error");
                }

                // Optionally, you can fully disable the button or adjust its appearance further
                assignButton.disabled = true;
            };
        }, delay);


    };

});


$(document).ready(function () {
    // Instantiate the MutationObserver
    const observer = new MutationObserver((mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === "childList") {
                console.log(mutation);
                // Check for a more specific condition to avoid unnecessary execution
                if (
                    mutation.addedNodes.length > 0 &&
                    mutation.target.matches(".col-7")
                ) {
                    processReviewerPanels();
                }
            }
        }
    });

    // Observer configuration
    const config = { childList: true, subtree: true };

    // Start observing
    observer.observe(document.body, config);

    // Initial call
    processReviewerPanels();
});
