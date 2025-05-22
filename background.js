// Import the calculations module
try {
  importScripts('calculations.js');
} catch (error) {
  console.error('Failed to import calculations.js:', error);
}

//Checks if oddsjam then runs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('oddsjam.com')) {
    // Wait a bit for the page to fully render before checking
    setTimeout(() => {
      runScraper(tabId);
    }, 1500); // 1.5 second delay
  }
});

function runScraper(tabId) {
  //Checks for table
  chrome.scripting.executeScript({
    target: {tabId: tabId},
    function: checkForTargetTable
  }, (results) => {
    if (results && results[0] && results[0].result) {
      console.log("Target table found, proceeding with scraping");
      
      // Step 1: Scrape the data
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: scrapeTargetedElements
      }, (scrapeResults) => {
        if (scrapeResults && scrapeResults[0] && scrapeResults[0].result) {
          const scraped = scrapeResults[0].result;
          console.log(`Scraped ${scraped.elements} elements`);
          
          // Step 2: Process the data with settings from storage
          chrome.storage.sync.get({
            bankroll: 5000, 
            kellyMultiplier: 1.05
          }, (settings) => {
            // Use the imported calculations
            const tableData = BettingCalculations.processTableData(
              scraped.text, 
              settings.bankroll, 
              settings.kellyMultiplier
            );
            
            // Step 3: Inject the new column
            chrome.scripting.executeScript({
              target: {tabId: tabId},
              function: injectBetSizeColumn
            }, () => {
              // Step 4: Update the bet sizes
              chrome.scripting.executeScript({
                target: {tabId: tabId},
                function: updateBetSizes,
                args: [tableData.map(row => row.betSize)]
              });
            });
          });
        }
      });
    } else {
      console.log("No suitable table found on this page");
    }
  });
}

// Check if there's a table that needs our processing
function checkForTargetTable() {
  const table = document.querySelector('table');
  if (!table) return false;

  const secondHeader = table.querySelector('thead tr th:nth-child(2)');
  if (secondHeader && secondHeader.textContent.toLowerCase().includes('game')) {
    if (!document.querySelector('.kelly_size')) {
      console.log("Second Column of Table found to be game")
      return true;
    }
  }
  return false;
}

// Scrape the data from the page
function scrapeTargetedElements() {
  try {
    const targetClass = "text-sm text-inherit __className_15aff7";
    console.log("Looking for class:", targetClass);
    
    const elements = document.querySelectorAll(`.${targetClass.split(' ').join('.')}`);
    console.log("Found elements:", elements.length);
    
    let result = "";
    elements.forEach((element, index) => {
      const text = element.textContent.trim();
      if (text) {
        result += `${index + 1}. ${text}\n\n`;
      }
    });
    
    return { text: result, elements: elements.length };
  } catch (error) {
    console.error(`Error during scraping: ${error.message}`);
    return { text: "", elements: 0, error: error.message };
  }
}

// Inject a new column for Kelly bet sizes
function injectBetSizeColumn() {
  const table = document.querySelector('table');
  if (!table) return;

  if (document.querySelector('.kelly_size')) {
    return;
  }

  const headerRow = table.querySelector('thead tr');
  if (!headerRow) return;

  const newHeader = document.createElement('th');
  newHeader.className = 'z-1 sticky top-0 bg-brand-gray border-none kelly_size';
  newHeader.innerHTML = `
    <div class="relative flex h-12 justify-between border-t border-[#4F5253] mt-4">
      <div class="flex flex-1 justify-center">
        <div class="relative flex items-center justify-center px-3 text-xs font-medium uppercase text-white select-none __className_9ac160" style="min-height: 36px;">
          <div>Kelly Bet Size</div>
        </div>
      </div>
      <div class="bg-brand-gray-1 w-px"></div>
    </div>
    <div class="mt-[-3px] h-[3px] w-full bg-transparent"></div>
  `;
  
  const seventhHeader = headerRow.children[6];
  if (seventhHeader) {
    seventhHeader.after(newHeader);
  } else {
    headerRow.appendChild(newHeader);
  }

  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const newCell = document.createElement('td');
    newCell.className = `${row.firstElementChild?.className || ''} kelly_size`;
    newCell.innerHTML = `
      <div class="flex h-full flex-col justify-center px-4 py-3 min-w-[100px] text-center hover:brightness-110">
        <p class="text-sm text-inherit kelly-bet-size">Calculating...</p>
      </div>
    `;
    
    const seventhCell = row.children[6];
    if (seventhCell) {
      seventhCell.after(newCell);
    } else {
      row.appendChild(newCell);
    }
  });
  
  console.log("Kelly column injected");
  return true;
}

// // Add this new function to handle bet placement
// function placeBet(betAmount) {
//   return new Promise((resolve) => {
//     // Wait for the portal to appear
//     const checkPortal = setInterval(() => {
//       const portal = document.querySelector('#headlessui-portal-root');
//       if (portal) {
//         clearInterval(checkPortal);
        
//         // Find and set the stake input
//         const stakeInput = portal.querySelector('#stake');
//         if (stakeInput) {
//           // Set the value and dispatch events to trigger any listeners
//           stakeInput.value = betAmount;
//           stakeInput.dispatchEvent(new Event('input', { bubbles: true }));
//           stakeInput.dispatchEvent(new Event('change', { bubbles: true }));
          
//           // Find and click the submit button
//           const submitButton = portal.querySelector('button[type="submit"]');
//           if (submitButton) {
//             submitButton.click();
//             resolve(true);
//           }
//         }
//       }
//     }, 100); // Check every 100ms

//     // Timeout after 10 seconds
//     setTimeout(() => {
//       clearInterval(checkPortal);
//       resolve(false);
//     }, 10000);
//   });
// }


// Update bet sizes in the UI
function updateBetSizes(betSizes) {
  const cells = document.querySelectorAll('.kelly-bet-size');
  console.log(`Found ${cells.length} kelly bet size cells`);
  console.log(`Received ${betSizes.length} bet sizes:`, betSizes);
  
  cells.forEach((cell, index) => {
    if (betSizes[index] !== undefined) {
      const dollarAmount = parseFloat(betSizes[index]).toFixed(2);
      cell.textContent = `$${dollarAmount}`;
    } else {
      cell.textContent = '$0.00';
    }
  });
  
  console.log("Bet sizes updated:", betSizes.length);
  return true;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "runScraper") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        runScraper(tabs[0].id);
        sendResponse({status: "Scraper started"});
      });
      return true; // Keep the message channel open for the async response
    } 
    else if (request.action === "updateSettings") {
      // Store settings when updated from popup
      chrome.storage.sync.set({
        bankroll: request.bankroll,
        kellyMultiplier: request.kellyMultiplier
      }, function() {
        console.log("Settings saved");
        sendResponse({status: "Settings saved"});
      });
      return true; // Keep the message channel open for the async response
    }
  }
);