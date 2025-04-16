// Includes top panel to the html page
async function includeTopMenu(){
    const response = await fetch("/top-panel.html")
    const data = await response.text()

    const menuContainer = document.createElement("div")
    menuContainer.innerHTML = data

    // Add the element to the body
    document.body.insertBefore(menuContainer, document.body.firstChild)

    // Set the active menu item
    const currentPath = window.location.pathname
    const menuItems = document.querySelectorAll(".nav-links a")

    for(let i = 0; i < menuItems.length; i++){
        // Remove the active class
        menuItems[i].classList.remove("topMenu-active")
        // Add the active class
        if((menuItems[i].getAttribute("href") === currentPath) || (currentPath === "/" && menuItems[i].getAttribute("href") === "#")){
            menuItems[i].classList.add("topMenu-active")
        }
    }

    // Signal addition of top menu to teh page
    document.dispatchEvent(new Event("topMenuLoaded"))
}

document.addEventListener("DOMContentLoaded", includeTopMenu)