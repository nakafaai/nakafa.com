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
        
        for i in range(min(5, len(links))):
            print(f"URL: {links[i][0]}")
            if i < len(snippets):
                # clean snippet
                clean_snippet = re.sub(r'<[^>]+>', '', snippets[i])
                print(f"Snippet: {clean_snippet}\n")
    except Exception as e:
        print(f"Error: {e}")

search("online course MOOC completion rates 2024 statistics")
print("---")
search("willingness to pay AI personalized tutoring vs static courses edtech 2024 data")
print("---")
search("fastest growing segments B2B EdTech technical training SaaS 2024 2025")
