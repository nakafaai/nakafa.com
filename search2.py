import urllib.request
import urllib.parse
import re

def search(query):
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        links = re.findall(r'<a class="result__url" href="([^"]+)">([^<]+)</a>', html)
        snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html)
        
        for i in range(min(3, len(links))):
            print(f"URL: {links[i][0]}")
            if i < len(snippets):
                clean_snippet = re.sub(r'<[^>]+>', '', snippets[i])
                print(f"Snippet: {clean_snippet}\n")
    except Exception as e:
        print(f"Error: {e}")

search("\"willingness to pay\" AI tutoring edtech data 2024")
print("---")
search("\"fastest growing\" \"B2B SaaS\" edtech market segment CAGR 2024")
